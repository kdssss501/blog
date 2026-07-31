# Artoria cinematic v2: frames 01-20 audit

Audit scope: `references/ref-01...ref-20` compared to each corresponding generated 4K PNG. The comparison sheet places the source on the left and the generated image on the right; rows run from 01 to 20, top to bottom.

Technical result: 20/20 generated files decode successfully as PNG at `3840 x 1600`. No file is black, empty, or below the requested resolution. No generated image contains visible text, watermark, or baked-in black bars.

| Frame | Source time | Result | Visual review |
| --- | --- | --- | --- |
| 01 | 0.05s | PASS | Blue-armored Saber on the grassland; one subject and matching wide composition. |
| 02 | 0.65s | PASS | Same identity, blue armor, sword, sunbeam and field are retained. |
| 03 | 1.25s | PASS | White transition with sword/light motifs is retained; intentional diffuse transition frame. |
| 04 | 1.80s | PASS | White-out reveal preserves the blue armored figure at frame right. |
| 05 | 2.35s | PASS | Single blue-armored full-body pose; no extra subject or malformed limbs. |
| 06 | 2.90s | PASS | Single blue-armored pose against the white transition background. |
| 07 | 3.45s | PASS | Blue-armored moving pose and skirt silhouette match the source. |
| 08 | 4.00s | PASS | Blue-armored turning pose is retained. |
| 09 | 4.55s | PASS | Arms-extended blue-armored pose is retained. |
| 10 | 4.72s | PASS | Fate/Zero changeover: black-suited Saber and the second male figure are retained; source title has been removed. |
| 11 | 5.05s | PASS | UBW changeover: two-character blue night scene, white dress and lighting retained. |
| 12 | 5.22s | PASS | Heaven's Feel changeover: two dark-clothed figures and magenta ringed environment retained. |
| 13 | 5.55s | PASS | Crowned/throne-room composition retains the central Saber and surrounding figures. |
| 14 | 5.72s | PASS | Summer changeover: beach, swimsuit Saber, companion and background swimmer retained. |
| 15 | 6.05s | PASS | Flower-crown white outfit and the two flanking characters retained. |
| 16 | 6.22s | PASS | Winter changeover: snowy group scene, costumes, gift/snow details and all figures retained. |
| 17 | 6.55s | PASS | Space-uniform changeover: blue space setting and full character group retained. |
| 18 | 6.72s | PASS | Store-casual changeover: shop interior, Saber, attendant and customer retained; source subtitle removed. |
| 19 | 7.05s | PASS | Single casual blue-dress pose retained; clean white transition background. |
| 20 | 7.55s | PASS | White-dress grassland pose retained with one subject and no visual defect. |

Conclusion: no required regeneration among frames 01-20. The five short-changeover frames that were added to the sequence (10, 12, 14, 16, 18) all preserve their intended outfit/state and can proceed to WebP conversion and frontend integration.
