import { vi } from "vitest";

// Mock the factory to avoid actual MongoDB connections during tests
vi.mock("$lib/server/factoryInstance", () => ({
	getFactory: vi.fn(() =>
		Promise.resolve({
			mongoManager: {
				getCollection: vi.fn(() =>
					Promise.resolve({
						updateOne: vi.fn(),
						removeOne: vi.fn(),
						findOne: vi.fn(),
						find: vi.fn(),
						count: vi.fn(),
					}),
				),
				getServersJson: vi.fn(() => Promise.resolve([])),
				getDatabasesJson: vi.fn(() => Promise.resolve([])),
				getCollectionsJson: vi.fn(() => Promise.resolve([])),
			},
			hostsManager: {
				add: vi.fn(),
				remove: vi.fn(),
			},
		}),
	),
}));
