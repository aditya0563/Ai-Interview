/**
 * packages/ui — Button component tests
 *
 * Tests run in jsdom via @testing-library/react.
 * No network, no server, no Tailwind compilation needed:
 * we assert on className strings directly, which is what the component sets.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./button";

// ═══════════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════════

describe("Button — rendering", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders as a <button> element", () => {
    render(<Button>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn.tagName).toBe("BUTTON");
  });

  it("renders children of mixed types (elements + text)", () => {
    render(
      <Button>
        <span>Icon</span> Label
      </Button>
    );
    expect(screen.getByText("Icon")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveTextContent("Label");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Variant CSS classes
// ═══════════════════════════════════════════════════════════════════════════

describe("Button — variant prop", () => {
  it("applies primary classes by default", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-blue-600");
    expect(btn.className).toContain("text-white");
  });

  it("applies secondary classes for variant='secondary'", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-white");
    expect(btn.className).toContain("text-gray-900");
    expect(btn.className).toContain("border-gray-300");
  });

  it("applies ghost classes for variant='ghost'", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-transparent");
    expect(btn.className).toContain("text-gray-700");
    expect(btn.className).toContain("hover:bg-gray-100");
  });

  it("applies destructive classes for variant='destructive'", () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-red-600");
    expect(btn.className).toContain("text-white");
    expect(btn.className).toContain("hover:bg-red-700");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Size CSS classes
// ═══════════════════════════════════════════════════════════════════════════

describe("Button — size prop", () => {
  it("applies md size classes by default", () => {
    render(<Button>Default size</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-4");
    expect(btn.className).toContain("py-2");
  });

  it("applies sm size classes for size='sm'", () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-3");
    expect(btn.className).toContain("py-1.5");
    expect(btn.className).toContain("text-sm");
  });

  it("applies lg size classes for size='lg'", () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-6");
    expect(btn.className).toContain("py-3");
    expect(btn.className).toContain("text-base");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isLoading prop
// ═══════════════════════════════════════════════════════════════════════════

describe("Button — isLoading prop", () => {
  it("renders the spinner SVG when isLoading=true", () => {
    render(<Button isLoading>Saving</Button>);
    // The spinner is an SVG with animate-spin class
    const svg = document.querySelector("svg.animate-spin");
    expect(svg).toBeInTheDocument();
  });

  it("does not render a spinner when isLoading=false", () => {
    render(<Button isLoading={false}>Save</Button>);
    expect(document.querySelector("svg.animate-spin")).not.toBeInTheDocument();
  });

  it("disables the button when isLoading=true", () => {
    render(<Button isLoading>Saving</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("still renders children text alongside the spinner", () => {
    render(<Button isLoading>Processing</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Processing");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// disabled prop
// ═══════════════════════════════════════════════════════════════════════════

describe("Button — disabled prop", () => {
  it("disables the button when disabled=true", () => {
    render(<Button disabled>Cannot click</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not disable the button when neither disabled nor isLoading", () => {
    render(<Button>Active</Button>);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// className prop (passthrough)
// ═══════════════════════════════════════════════════════════════════════════

describe("Button — className prop", () => {
  it("appends a custom className to the base classes", () => {
    render(<Button className="my-custom-class">Custom</Button>);
    expect(screen.getByRole("button").className).toContain("my-custom-class");
  });

  it("does not lose base classes when className is provided", () => {
    render(<Button className="extra">Styled</Button>);
    const btn = screen.getByRole("button");
    // Base always present
    expect(btn.className).toContain("inline-flex");
    expect(btn.className).toContain("extra");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Event handlers (user interactions)
// ═══════════════════════════════════════════════════════════════════════════

describe("Button — event handlers", () => {
  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when button is disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when isLoading=true", () => {
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Loading
      </Button>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("passes additional HTML button props through", () => {
    render(
      <Button type="submit" aria-label="Submit form">
        Submit
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("type", "submit");
    expect(btn).toHaveAttribute("aria-label", "Submit form");
  });
});
