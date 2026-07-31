# 吸血鬼 Live2D 与 SoulLink 运行时

## 当前资产基线

- 本地源目录由 `VAMPIRE_LIVE2D_SOURCE_DIR` 指定，页面不暴露磁盘路径。
- 运行时包含 1 个 MOC、4 张 8192 纹理、1 个 Physics、1 个 CDI、12 个原生表达文件和 1 个 Idle Motion。
- 模型提供 194 个参数、43 组 Physics 和 61 个 Part。
- 原资产只有一个作者 Motion。其余动作由 SoulLink FACS、原生参数和 Physics 组合，不虚构不存在的 `motion3` 文件。

## 表演状态机

状态机位于 `src/features/xiao/model/vampire-performance.ts`。助手完整回复落盘后才触发最终表演；只有实际语音播放阶段才启用麦克风动作和音量口型。

| 回答场景 | 命中示例 | SoulLink 情绪 | 原生表情 | 参数动作 |
| --- | --- | --- | --- | --- |
| 警告保护 | 危险、警告、立即停止 | anger | 黑脸生气 | 前倾、抿嘴、歪嘴；危险文本叠加美工刀 |
| 安慰陪伴 | 辛苦了、难过、陪着你 | concerned | 哭哭 | 轻微前倾、嘴部耸动、轻抿嘴 |
| 成功庆祝 | 成功、通过、已经修好 | happy | 星星眼 | 前倾、张颌、轻微歪嘴 |
| 亲近回应 | 谢谢你、晚安、我会记住 | affectionate | 爱心眼 | 强前倾、鼓脸、抿嘴、噘嘴 |
| 疑惑复查 | 不太确定、再确认、没看懂 | confused | 蚊香眼 | 前倾、嘴部耸动、歪嘴 |
| 专注工作 | 分析、代码、调试、绘制、修图 | curious | 星星眼 | 前倾、轻鼓脸、歪嘴；工作文本叠加数位板 |

动作关键词独立于场景：直播、朗读、唱歌触发麦克风；绘图、代码、设计触发数位板；危险、战斗、切割触发美工刀；点击、按钮触发 `Paramclick`。脸部、胸口、衣服和受伤相关文本分别映射两组血迹。

VBridger 嘴型也支持明确文本触发：鼓脸、赌气驱动 Cheek Puff；噘嘴、亲吻驱动 Funnel 与 Pucker；咧嘴、扁嘴使用 Pucker 的负向范围；抿嘴驱动 Press Lip；歪嘴、坏笑驱动 Mouth X；吃一口、点心、蛋糕、饼干或咀嚼触发两次张颌/闭颌序列。所有参数序列都经 SoulLink `parameterPlan` 插值并自动回落，不会永久覆盖面捕中性值。

优先级为：手动表情 > 当前 SoulLink 表情；手动血迹与自动血迹可叠加；手动动作不会被聊天阶段覆盖。手动表情 5.6 秒后自动归还，自动动作和血迹按表演时长复位。

## 原生控制映射

| 能力 | 参数或资产 |
| --- | --- |
| 爱心眼、星星眼、生气、哭哭、脸红、蚊香眼 | `hearteyes`、`stareyes`、`mad`、`sad`、`shy`、`circleeyes` |
| 面部血迹、身体血迹 | `PARAMBLOOD2`、`PARAMblood1` |
| 麦克风、捧脸美工刀、数位板 | `PARAMhands_1/2/3` |
| 数位板坐标与按下 | `ParammouseX`、`ParammouseY`、`Paramclick` |
| 鼠标眼神与轻微头动 | `PARAM_EYE_BALL_X/Y`、`PARAM_ANGLE_X/Y` |
| 双眉同步 | `PARAM_BROW_L_Y/FORM`、`PARAM_BROW_R_Y/FORM` |
| 基础与 VBridger 口型 | `PARAM_MOUTH_OPEN_Y`、`PARAM_JAW_OPEN`、Funnel、Pucker、Shrug、Cheek Puff、Lip Press |
| 歪嘴 | `PARAMMOUSE_X` |
| 前倾 | `PARAM_BODY_POSITION_Z`，使用模型真实 `0..10` 范围 |

## 装扮替换

面板覆盖全部 17 个可确认的原生装扮参数：

- 发色、发饰、服装黑白切换。
- 呆毛显隐、M 字/齐刘海、两种刘海长度和侧发长度。
- 左单、右单、双马尾或无马尾，以及马尾长度。
- 长发显隐与长度，可与马尾同时存在。
- 创口贴、环形、十字架三个发夹。

环形发夹只适配 M 字刘海。切到齐刘海时，运行时和 UI 都会强制关闭它。

这 17 项已经覆盖 CDI 中全部可确认的装扮输入。`Paramwings`、发丝、耳饰摆动、蝴蝶结、衣服、裙摆、袖子、胸口和腿部参数是 Physics 计算结果，不是显隐或换装输入，因此不会加入装扮面板。强行写入这些值会与 43 组物理计算争夺控制权并产生抖动。

## 本地日语语音

DeepSeek 的吸血鬼模式固定返回 `display`、`speechJa`、`emotion`。聊天框展示 `display`，GPT-SoVITS 只接收经过校验的 1 至 3 句连续日语 `speechJa`。服务端固定映射四档参考音频：欣慰、害羞、委屈、责备；客户端不能提交磁盘路径。

GPT-SoVITS 必须作为常驻服务运行，避免每次请求重新加载约 19 秒。日常开发使用统一启动命令：

```powershell
pnpm tts:preflight
pnpm dev
```

`pnpm dev` 会先复用或启动 `127.0.0.1:9880` 的 GPT-SoVITS，健康检查通过后再启动 Astro。默认地址为 `http://127.0.0.1:4321`；可用 `pnpm dev -- --port 4325` 或环境变量 `ASTRO_PORT` 更改端口。`Ctrl+C` 会停止本次命令创建的两个子进程，但不会误停启动前已经存在的 TTS 服务。若 Astro 端口已经被占用，启动器会直接报错，避免产生重复进程。运行 `pnpm dev -- --help` 可查看完整参数。只需要网页时可运行 `pnpm dev:web`；`pnpm dev:local` 保留为兼容别名。

不需要语音时运行 `pnpm tts:stop` 释放显存。

健康检查为 `GET /api/xiao/tts/health`。语音接口只允许本机同源请求，并由服务器串行处理 GPU 推理。页面按排队、生成、缓冲、播放显示进度；播放阶段由 `AudioContext` 的真实 RMS 音量驱动 SoulLink 口型，最近四条语音保存在内存中供重播。

## 验证

```powershell
node --experimental-strip-types tests/unit/vampire-performance.mjs
pnpm test:tts
pnpm test:tts:e2e
node -e "process.env.E2E_BASE_URL='http://127.0.0.1:4371';process.env.E2E_REQUIRE_LIVE2D='1';import('./tests/e2e/xiao-hub.mjs')"
```

E2E 使用 Edge 验证 1920x1080、移动端和减少动态模式，并检查 21 个运行时文件引用全部返回 200、SoulLink 缺失参数计数为 0。测试还覆盖全部模型按钮及其原生参数、17 项装扮与互斥、鼠标眼头跟随及两秒平滑归位、双眉同步、数位板坐标/按下、流式麦克风、手动动作优先级、回答场景和全部 VBridger 参数序列。

## 发布边界

购买模型不默认复制到 `public/`。本机开发由受限 Vite 代理读取源目录；生产环境必须把 `PUBLIC_VAMPIRE_MODEL_URL` 指向已获授权且包含相同规范化 manifest 的私有资产地址。
