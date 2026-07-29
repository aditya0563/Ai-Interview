import { render } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { AudioVisualizer } from "./audio-visualizer";
import React from "react";

describe("AudioVisualizer Component", () => {
  let mockStart: ReturnType<typeof vi.fn>;
  let mockStop: ReturnType<typeof vi.fn>;
  let latestInstance: any = null;

  beforeEach(() => {
    mockStart = vi.fn();
    mockStop = vi.fn();
    latestInstance = null;
    
    // Explicitly mock SpeechRecognition
    const MockSpeechRecognition = class {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onresult = null;
      onerror = null;
      onend: (() => void) | null = null;
      
      constructor() {
        latestInstance = this;
      }
      
      start = mockStart;
      stop = mockStop;
    };

    global.window.SpeechRecognition = MockSpeechRecognition as any;
    global.window.alert = vi.fn();

    // Mock AudioContext and other Web APIs
    global.AudioContext = vi.fn().mockImplementation(() => ({
      state: "running",
      resume: vi.fn().mockResolvedValue(undefined),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 256,
        smoothingTimeConstant: 0.8,
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
    
    // Set system time to 0 to easily test the Date.now() diff logic (5000ms threshold)
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete (global.window as any).SpeechRecognition;
    delete (global as any).AudioContext;
    delete (global as any).ResizeObserver;
  });

  it("Test Case 2: The Circuit Breaker - trips after rapid failures", () => {
    // Arrange: Create a fake MediaStream
    const mockStream = {
      getTracks: () => [],
    } as unknown as MediaStream;

    render(<AudioVisualizer stream={mockStream} />);

    // Initial start happens on mount (Call count: 1)
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(latestInstance).not.toBeNull();

    // Act & Assert: Rapidly trigger onend 4 times
    
    // Failure 1 (Time: 0ms, Diff < 5000ms -> retryCount: 1) -> Start called
    latestInstance.onend();
    expect(mockStart).toHaveBeenCalledTimes(2);

    // Failure 2 (Time: 100ms, Diff < 5000ms -> retryCount: 2) -> Start called
    vi.advanceTimersByTime(100);
    latestInstance.onend();
    expect(mockStart).toHaveBeenCalledTimes(3);

    // Failure 3 (Time: 200ms, Diff < 5000ms -> retryCount: 3) -> Trips breaker
    vi.advanceTimersByTime(100);
    latestInstance.onend();
    // Verify alert toast was triggered
    expect(global.window.alert).toHaveBeenCalledWith(
      "Speech recognition disconnected. Please check your microphone permissions and refresh."
    );
    // Start should NOT be called again (Circuit Breaker is now open)
    expect(mockStart).toHaveBeenCalledTimes(3);

    // Failure 4 (Time: 300ms, Diff < 5000ms -> retryCount: 4) -> Breaker remains tripped
    vi.advanceTimersByTime(100);
    latestInstance.onend();
    // Alert called again
    expect(global.window.alert).toHaveBeenCalledTimes(2);
    // Start remains at exactly 3 calls
    expect(mockStart).toHaveBeenCalledTimes(3);
  });
});
