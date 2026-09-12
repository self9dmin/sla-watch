import {
  parseServiceTelemetry,
  summarizeServiceTelemetry,
} from "../ui/app/data/serviceTelemetry";

describe("service telemetry", () => {
  it("aggregates split dimensions by classic service ID", () => {
    const telemetry = parseServiceTelemetry({
      records: [
        {
          service_classic_id: "SERVICE-1",
          request_count: 100,
          failure_count: 4,
        },
        {
          service_classic_id: "service-1",
          request_count: "50",
          failure_count: "1",
        },
      ],
    });
    expect(telemetry.get("service-1")).toEqual({
      requestCount: 150,
      failureCount: 5,
    });
  });

  it("summarizes unique affected services without double counting", () => {
    const telemetry = new Map([
      ["service-1", { requestCount: 100, failureCount: 4 }],
      ["service-2", { requestCount: 200, failureCount: 6 }],
    ]);
    expect(summarizeServiceTelemetry(
      telemetry,
      ["SERVICE-1", "service-1", "SERVICE-2"],
    )).toEqual({ requestCount: 300, failureCount: 10 });
  });
});
