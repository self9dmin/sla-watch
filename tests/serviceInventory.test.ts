import { parseServiceRecords } from "../ui/app/data/serviceInventory";

describe("Smartscape service inventory parsing", () => {
  it("preserves exact service identity, names, and object tags", () => {
    expect(parseServiceRecords({ records: [{
      id: "SERVICE-1",
      name: "Checkout",
      type: "SERVICE",
      tags: { provider: "aws", owner: ["payments", "platform"] },
    }] })).toEqual([{
      id: "SERVICE-1",
      name: "Checkout",
      type: "SERVICE",
      tags: ["provider:aws", "owner:payments", "owner:platform"],
    }]);
  });

  it("retains legacy tag arrays during the Smartscape migration", () => {
    expect(parseServiceRecords({ records: [{
      id: "SERVICE-2",
      tags: [{ key: "provider", value: "azure" }, "team:checkout"],
    }] })).toEqual([{
      id: "SERVICE-2",
      name: "SERVICE-2",
      type: "SERVICE",
      tags: ["provider:azure", "team:checkout"],
    }]);
  });

  it("drops a malformed row instead of fabricating an entity ID", () => {
    expect(parseServiceRecords({ records: [{ name: "Missing identity" }] })).toEqual([]);
  });
});
