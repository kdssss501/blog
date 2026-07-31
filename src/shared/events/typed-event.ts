type EventMap = object;

export function emitTypedEvent<
	Events extends EventMap,
	Name extends Extract<keyof Events, string>,
>(target: EventTarget, name: Name, detail: Events[Name]): void {
	target.dispatchEvent(new CustomEvent(name, { detail }));
}

export function subscribeTypedEvent<
	Events extends EventMap,
	Name extends Extract<keyof Events, string>,
>(
	target: EventTarget,
	name: Name,
	listener: (detail: Events[Name], event: CustomEvent<Events[Name]>) => void,
): () => void {
	const handler: EventListener = (event) => {
		const customEvent = event as CustomEvent<Events[Name]>;
		listener(customEvent.detail, customEvent);
	};

	target.addEventListener(name, handler);
	return () => target.removeEventListener(name, handler);
}
