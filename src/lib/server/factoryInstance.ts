import Factory from "./Factory";

let factory: typeof Factory | null = null;

export async function getFactory() {
	if (!factory) {
		await Factory.load();
		factory = Factory;
	}
	return factory;
}

export { factory };
