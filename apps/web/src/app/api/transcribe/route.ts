import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Extract form data from the incoming request
    const formData = await request.formData();

    // Check common field names first, then fall back to finding the first Blob value in formData
    let file: Blob | null = null;
    const commonFieldNames = ["file", "audio", "audioFile"];

    for (const name of commonFieldNames) {
      const value = formData.get(name);
      if (value instanceof Blob) {
        file = value;
        break;
      }
    }

    if (!file) {
      for (const value of formData.values()) {
        if (value instanceof Blob) {
          file = value;
          break;
        }
      }
    }

    // Return a 400 status if no audio file is found
    if (!file) {
      return NextResponse.json(
        { error: "No audio file found in the request" },
        { status: 400 }
      );
    }

    // Convert the file blob into a node buffer using arrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Make a fetch request to the Deepgram API endpoint
    const deepgramUrl =
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true";

    const response = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "audio/webm",
      },
      body: buffer as unknown as BodyInit,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Deepgram API error (${response.status}):`,
        errorText
      );
      throw new Error(`Deepgram API failed with status ${response.status}`);
    }

    // Parse the response and extract the transcript from results -> channels -> alternatives -> transcript
    const data = await response.json();
    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    // Return the extracted text using NextResponse
    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Transcription route error:", error);
    // Return a 500 status code if the transcription fails
    return NextResponse.json(
      { error: "Internal server error during transcription" },
      { status: 500 }
    );
  }
}
