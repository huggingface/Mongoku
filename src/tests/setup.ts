import { vi } from "vitest";

// Mock the mongo module to avoid actual MongoDB connections during tests
vi.mock("$lib/server/mongo", () => ({
	getMongo: vi.fn(() =>
		Promise.resolve({
			findOne: vi.fn(),
			find: vi.fn(),
			count: vi.fn(),
			updateOne: vi.fn(),
			removeOne: vi.fn(),
			getServersJson: vi.fn(() => Promise.resolve([])),
			getDatabasesJson: vi.fn(() => Promise.resolve([])),
			getCollectionsJson: vi.fn(() => Promise.resolve([])),
			addServer: vi.fn(),
			removeServer: vi.fn(),
		}),
	),
}));
