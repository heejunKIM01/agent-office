import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/utils/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const { usePreferencesStore } = await import("@/stores/preferencesStore");

const saved = (prefs: Record<string, string>): Response =>
  ({ ok: true, json: async () => prefs }) as Response;

describe("officeView", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    usePreferencesStore.setState({ officeView: "floor" });
  });

  it("shows the floor unless another view was chosen", async () => {
    apiFetch.mockResolvedValueOnce(saved({}));
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().officeView).toBe("floor");

    apiFetch.mockResolvedValueOnce(saved({ office_view: "building" }));
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().officeView).toBe("building");

    apiFetch.mockResolvedValueOnce(saved({ office_view: "upstairs" }));
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().officeView).toBe("floor");
  });

  it("keeps the old switch turned off as the chosen session alone", async () => {
    apiFetch.mockResolvedValueOnce(saved({ show_floor_colleagues: "false" }));
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().officeView).toBe("session");

    apiFetch.mockResolvedValueOnce(
      saved({ show_floor_colleagues: "false", office_view: "building" }),
    );
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().officeView).toBe("building");
  });

  it("saves the choice", async () => {
    apiFetch.mockResolvedValueOnce(saved({}));
    await usePreferencesStore.getState().setOfficeView("building");
    expect(usePreferencesStore.getState().officeView).toBe("building");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/preferences/office_view",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ value: "building" }),
      }),
    );
  });
});

describe("place", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    usePreferencesStore.setState({ place: "office" });
  });

  it("shows the office unless the airport was chosen", async () => {
    apiFetch.mockResolvedValueOnce(saved({}));
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().place).toBe("office");

    apiFetch.mockResolvedValueOnce(saved({ place: "airport" }));
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().place).toBe("airport");

    usePreferencesStore.setState({ place: "office" });
    apiFetch.mockResolvedValueOnce(saved({ place: "moon" }));
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().place).toBe("office");
  });

  it("saves the choice", async () => {
    apiFetch.mockResolvedValueOnce(saved({}));
    await usePreferencesStore.getState().setPlace("airport");
    expect(usePreferencesStore.getState().place).toBe("airport");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/preferences/place",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ value: "airport" }),
      }),
    );
  });
});
