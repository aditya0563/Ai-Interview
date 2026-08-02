import { render } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { AudioVisualizer } from "./audio-visualizer";
import React from "react";

describe("AudioVisualizer Component", () => {
  beforeEach(() => {
    // Mock AudioContext and Web APIs
    global.AudioContext = vi.fn().mockImplementation(() => ({
      state: "running",
      resume: vi.fn().mockResolvedValue(undefined),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 256,
        smoothingTimeConstant: 0.8,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn(),
        disconnect: vi.fn(),
      }),
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
    })) as any;

    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
    
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      fill: vi.fn(),
      scale: vi.fn(),
    }) as any;

    global.requestAnimationFrame = vi.fn().mockReturnValue(1);
    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (global as any).AudioContext;
    delete (global as any).ResizeObserver;
  });

  it("renders idle visualizer when stream is null", () => {
    const { getByRole } = render(<AudioVisualizer stream={null} />);
    const canvas = getByRole("img");
    expect(canvas.getAttribute("aria-label")).toBe("Audio visualizer idle state");
  });

  it("renders live audio visualizer when active stream is provided", () => {
    const mockStream = {
      getTracks: () => [],
    } as unknown as MediaStream;

    const { getByRole, getByText } = render(<AudioVisualizer stream={mockStream} />);
    const canvas = getByRole("img");
    expect(canvas.getAttribute("aria-label")).toBe("Real-time audio frequency visualizer");
    expect(getByText("Live")).not.toBeNull();
  });
});
