import React, { useState } from "react";

const ImageRecyclingChecker = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file || null);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  return (
    <div className="p-8 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-xl p-6 shadow">
        <h1 className="text-2xl font-bold">Recycling Scan</h1>

        <div className="w-full h-64 border-4 border-dashed rounded-xl flex items-center justify-center mt-4">
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Selected item for recycling check"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center text-blue-500 p-4">
              <p className="font-semibold text-sm">
                Tap below to select an image
              </p>
            </div>
          )}
        </div>

        <label
          htmlFor="file-upload"
          className="w-full block mt-6 bg-blue-600 text-white py-3 rounded-xl text-center cursor-pointer"
        >
          {selectedFile ? "Change Photo" : "Upload Item Photo"}
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default ImageRecyclingChecker;
