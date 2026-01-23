import { describe, expect, it } from "vitest";
import { parseSpecificationsFromText, parseSpecificationLine } from "./specificationPaste";

describe("specification paste parser", () => {
  it("splits at first digit", () => {
    expect(parseSpecificationLine("Item Weight25 g")).toEqual({
      label: "Item Weight",
      value: "25 g",
    });
  });

  it("splits at lower->upper boundary", () => {
    expect(parseSpecificationLine("PackerSalty E-Commerce Pvt. Ltd.")).toEqual({
      label: "Packer",
      value: "Salty E-Commerce Pvt. Ltd.",
    });
  });

  it("handles colon separator", () => {
    expect(parseSpecificationLine("Net Quantity: 1.0 Count")).toEqual({
      label: "Net Quantity",
      value: "1.0 Count",
    });
  });

  it("parses example block into pairs", () => {
    const text = [
      "Manufacturer207, Ground Floor, Okhla Industrial Area, Phase 3, Delhi - 110020, Salty E-Commerce Pvt. Ltd.",
      "PackerSalty E-Commerce Pvt. Ltd., 207, Ground Floor, Okhla Industrial Area, Phase 3, Delhi - 110020",
      "Item Weight25 g",
      "Item Dimensions LxWxH20 x 25 x 20 Millimeters",
      "Net Quantity1.0 Count",
      "Generic NameRing Watch",
    ].join("\n");

    expect(parseSpecificationsFromText(text)).toEqual([
      {
        label: "Manufacturer",
        value: "207, Ground Floor, Okhla Industrial Area, Phase 3, Delhi - 110020, Salty E-Commerce Pvt. Ltd.",
      },
      {
        label: "Packer",
        value: "Salty E-Commerce Pvt. Ltd., 207, Ground Floor, Okhla Industrial Area, Phase 3, Delhi - 110020",
      },
      { label: "Item Weight", value: "25 g" },
      { label: "Item Dimensions LxWxH", value: "20 x 25 x 20 Millimeters" },
      { label: "Net Quantity", value: "1.0 Count" },
      { label: "Generic Name", value: "Ring Watch" },
    ]);
  });
});
