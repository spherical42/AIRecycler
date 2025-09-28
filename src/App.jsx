import React, { useState, useCallback, useMemo } from "react";
import { Camera, RefreshCcw, Loader, CheckCircle, XCircle } from "lucide-react";

//api stuff
const API_CONFIG = {
  model: "gemini-2.5-flash-preview-05-20",
  //api url
  apiUrl:
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent",
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  // prompt given to gemini
  systemPrompt:
    "You are a recycling expert application. Your sole function is to analyze the provided image and determine if the main object is generally recyclable through common municipal programs (like plastic bottles, paper, cardboard, metal cans). You must respond with only two sentences: the first sentence clearly states 'Recyclable' or 'Not Recyclable' (use bold text for this outcome), and the second sentence provides a brief, specific explanation and any necessary caveats (e.g., 'This plastic bottle is recyclable, but remove the cap first.'). Do not include any greeting or conversational fluff. Start every response with gee whiz.",
};

// utility function for exponential backoff
const retryFetch = async (url, options, maxRetries = 5) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        // If it's a 4xx or 5xx error, try again unless it's a terminal error like 400
        if (response.status === 400 || attempt === maxRetries - 1) {
          throw new Error(
            `API Request failed with status ${response.status}: ${response.statusText}`,
          );
        }
        throw new Error("Retrying due to server error or rate limiting...");
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error("Max retries reached. Failing request.", error);
        throw error;
      }
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

//displays UI based on state
const ResultDisplay = ({ result, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader className="animate-spin text-blue-500 w-6 h-6 mr-3" />
        <span className="text-gray-600 font-medium">Analyzing...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm mt-4">
        <p className="font-bold">Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (result) {
    //show result
    const isRecyclable = result.includes("**Recyclable**");
    const Icon = isRecyclable ? CheckCircle : XCircle;
    const colorClass = isRecyclable
      ? "text-emerald-600 bg-emerald-50 border-emerald-300"
      : "text-rose-600 bg-rose-50 border-rose-300";
    const title = isRecyclable ? "Good Job!" : "Check Local Rules";

    // Safely extract the explanation part for styling
    const parts = result.split(/(\*\*Recyclable\*\*|\*\*Not Recyclable\*\*)/i);
    const explanation =
      parts.length > 2 ? parts[parts.length - 1].trim() : result.trim();

    return (
      <div
        className={`p-4 mt-4 border rounded-2xl shadow-lg transition-all duration-300 ${colorClass}`}
      >
        <div className="flex items-start">
          <Icon className="w-8 h-8 flex-shrink-0 mt-0.5" />
          <div className="ml-4">
            <h2 className="text-xl font-extrabold mb-1">{title}</h2>
            <div
              className="text-sm font-medium leading-relaxed"
              dangerouslySetInnerHTML={{ __html: explanation }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    //defualt state before photo upload or analysis
    <div className="mt-6 p-4 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl">
      <p className="font-semibold">Upload a photo to start the analysis.</p>
    </div>
  );
};

const ImageRecyclingChecker = () => {
  // State variables for file upload and analysis
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Handle File Selection and Base64 Conversion
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisResult(null);
      setError(null);

      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  //Add reset behavior
  const resetApp = useCallback(() => {
    setSelectedFile(null); //clears the following
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
    // Clear the file input value to allow selecting the same file again
    document.getElementById("file-upload").value = null;
  }, []);

  // 3. Construct the API payload
  const createPayload = useCallback(() => {
    if (!imagePreview) return null;

    // Extract mimeType and base64 data from the data URL
    const [mimeTypePart, dataPart] = imagePreview.split(",");
    const mimeType = mimeTypePart.match(/data:(.*?);/)?.[1] || "image/jpeg";
    const base64ImageData = dataPart;

    return {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Is this object recyclable? Provide the analysis based on your system instructions.",
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64ImageData,
              },
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: API_CONFIG.systemPrompt }],
      },
    };
  }, [imagePreview]);

  // 4. Call the Gemini API
  const analyzeImage = useCallback(async () => {
    if (!selectedFile) {
      setError("Please select an image first."); //error if no file selected
      return;
    }
    //reset states before analysis
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    const payload = createPayload();
    if (!payload) return;

    try {
      //get ai response
      const url = `${API_CONFIG.apiUrl}?key=${API_CONFIG.apiKey}`;
      const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };

      const response = await retryFetch(url, options);
      const result = await response.json();

      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        setAnalysisResult(text);
      } else {
        setError("Analysis failed. The AI response was empty or malformed.");
      }
    } catch (err) {
      console.error("Gemini API Error:", err);
      setError("Failed to connect to the analysis service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, createPayload]);

  // Use memo to determine button disabled state
  const isAnalyzeDisabled = useMemo(
    () => !selectedFile || isLoading,
    [selectedFile, isLoading],
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black text-gray-800 flex items-center">
            <Camera className="w-6 h-6 mr-2 text-blue-600" />
            Recycling Scan
          </h1>
          <button
            onClick={resetApp}
            className="p-2 text-gray-500 hover:text-blue-600 transition duration-150"
            aria-label="Clear all and start new scan"
            title="Clear Scan"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview Area */}
        <div
          className={`w-full h-64 border-4 border-dashed rounded-xl overflow-hidden mb-6
            ${imagePreview ? "border-gray-300" : "border-blue-200 bg-blue-50"}
            flex items-center justify-center transition-all duration-300`}
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Selected item for recycling check"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center text-blue-500 p-4">
              <Camera className="w-8 h-8 mx-auto mb-2" />
              <p className="font-semibold text-sm">
                Tap below to select an image
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-4">
          <label
            htmlFor="file-upload"
            className={`w-full text-center py-3 px-4 rounded-xl font-bold text-lg cursor-pointer transition duration-200
              ${isLoading ? "bg-gray-400 text-gray-600" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/50"}`}
          >
            {selectedFile ? "Change Photo" : "Upload Item Photo"}
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isLoading}
            className="hidden"
          />

          <button
            onClick={analyzeImage}
            disabled={isAnalyzeDisabled}
            className={`w-full py-3 px-4 rounded-xl font-bold text-lg transition duration-200
              ${
                isAnalyzeDisabled
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/50"
              }`}
          >
            {isLoading ? "Analyzing..." : "Scan for Recyclability"}
          </button>
        </div>

        <ResultDisplay
          result={analysisResult}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
};

export default ImageRecyclingChecker;
