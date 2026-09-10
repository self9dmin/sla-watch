import { parseSmartscapeScopeEdges, uniqueLocations, uniqueRuntimeTargets } from "../ui/app/data/topology";

describe("Smartscape scope parsing", () => {
  const data = {
    records: [
      {
        service_node_id: "service-node-1",
        service_classic_id: "SERVICE-1",
        service_name: "Checkout",
        target_node_id: "host-node-1",
        target_classic_id: "HOST-1",
        target_name: "checkout-a",
        target_type: "HOST",
        relationship: "runs_on",
        aws_region: "us-east-1",
        aws_availability_zone: "us-east-1a",
      },
      {
        service_node_id: "service-node-2",
        service_classic_id: "SERVICE-2",
        service_name: "Payments",
        target_node_id: "host-node-1",
        target_classic_id: "HOST-1",
        target_name: "checkout-a",
        target_type: "HOST",
        relationship: "runs_on",
        aws_region: "us-east-1",
        aws_availability_zone: "us-east-1a",
      },
    ],
  };

  it("prefers the most precise location returned by Smartscape", () => {
    const edges = parseSmartscapeScopeEdges(data);
    expect(edges[0].location).toBe("us-east-1a");
    expect(uniqueLocations(edges)).toEqual(["us-east-1a"]);
  });

  it("deduplicates runtime choices by Smartscape node ID", () => {
    expect(uniqueRuntimeTargets(parseSmartscapeScopeEdges(data))).toHaveLength(1);
  });
});
