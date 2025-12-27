import React, { useState, useEffect, useRef } from "react";
import toastHelper from "../../utils/toastHelper";
import { ProductService } from "../../services/products/products.services";

const placeholderImage = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMmyTPv4M5fFPvYLrMzMQcPD_VO34ByNjouQ&s";

interface Product {
  _id?: string;
  id?: string;
  specification?: string;
  name?: string;
  images?: string[];
  videos?: string[];
}

interface ProductImageVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdate?: () => void;
}

const ProductImageVideoModal: React.FC<ProductImageVideoModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdate,
}) => {
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newVideos, setNewVideos] = useState<File[]>([]);
  const [existingVideos, setExistingVideos] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string>("");
  const [videoError, setVideoError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 10;
  const MAX_VIDEOS = 2;

  const base = (import.meta as { env?: { VITE_BASE_URL?: string } }).env?.VITE_BASE_URL || "";

  const getImageUrl = (path: string): string => {
    if (!path) return placeholderImage;
    const isAbsolute = /^https?:\/\//i.test(path);
    return isAbsolute
      ? path
      : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const getVideoUrl = (path: string): string => {
    if (!path) return "";
    const isAbsolute = /^https?:\/\//i.test(path);
    return isAbsolute
      ? path
      : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Load existing images and videos when product changes
  useEffect(() => {
    if (isOpen && product) {
      if (product.images) {
        const imageArray = Array.isArray(product.images) 
          ? product.images.filter((img: string) => img && String(img).trim() !== "")
          : [];
        setExistingImages(imageArray);
      } else {
        setExistingImages([]);
      }

      if (product.videos) {
        const videoArray = Array.isArray(product.videos)
          ? product.videos.filter((vid: string) => vid && String(vid).trim() !== "")
          : [];
        setExistingVideos(videoArray);
      } else {
        setExistingVideos([]);
      }
    } else {
      setExistingImages([]);
      setExistingVideos([]);
    }
    setNewImages([]);
    setNewVideos([]);
    setImageError("");
    setVideoError("");
  }, [isOpen, product]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'image' | 'video') => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      type === 'image' ? file.type.startsWith("image/") : file.type.startsWith("video/")
    );
    
    if (type === 'image') {
      const totalImages = existingImages.length + newImages.length + files.length;
      if (totalImages > MAX_IMAGES) {
        setImageError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }
      if (files.length > 0) {
        setImageError("");
        setNewImages((prev) => [...prev, ...files]);
      }
    } else {
      const totalVideos = existingVideos.length + newVideos.length + files.length;
      if (totalVideos > MAX_VIDEOS) {
        setVideoError(`Maximum ${MAX_VIDEOS} videos allowed`);
        return;
      }
      if (files.length > 0) {
        setVideoError("");
        setNewVideos((prev) => [...prev, ...files]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    
    if (type === 'image') {
      const totalImages = existingImages.length + newImages.length + files.length;
      if (totalImages > MAX_IMAGES) {
        setImageError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }
      setImageError("");
      setNewImages((prev) => [...prev, ...files]);
    } else {
      const totalVideos = existingVideos.length + newVideos.length + files.length;
      if (totalVideos > MAX_VIDEOS) {
        setVideoError(`Maximum ${MAX_VIDEOS} videos allowed`);
        return;
      }
      setVideoError("");
      setNewVideos((prev) => [...prev, ...files]);
    }
    
    // Reset input
    e.target.value = '';
  };

  const handleClick = (type: 'image' | 'video') => {
    if (type === 'image') {
      imageInputRef.current?.click();
    } else {
      videoInputRef.current?.click();
    }
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
    setImageError("");
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setImageError("");
  };

  const handleRemoveExistingVideo = (index: number) => {
    setExistingVideos((prev) => prev.filter((_, i) => i !== index));
    setVideoError("");
  };

  const handleRemoveNewVideo = (index: number) => {
    setNewVideos((prev) => prev.filter((_, i) => i !== index));
    setVideoError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!product || (!product._id && !product.id)) {
      toastHelper.showTost('Product not found', 'error');
      return;
    }

    setIsLoading(true);
    setImageError("");
    setVideoError("");

    try {
      const formDataToSend = new FormData();
      const productId = product._id || product.id;
      
      // Add product ID
      formDataToSend.append("id", productId!);
      
      // Handle kept images
      if (existingImages.length > 0) {
        formDataToSend.append("keptImages", JSON.stringify(existingImages));
      }

      // Handle kept videos
      if (existingVideos.length > 0) {
        formDataToSend.append("keptVideos", JSON.stringify(existingVideos));
      }

      // Append new images
      newImages.forEach((image) => {
        formDataToSend.append("images", image);
      });

      // Append new videos
      newVideos.forEach((video) => {
        formDataToSend.append("videos", video);
      });

      // Call update endpoint
      await ProductService.updateProductImagesVideos(productId!, formDataToSend);
      
      toastHelper.showTost('Product images and videos updated successfully!', 'success');
      onClose();
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      const errorMessage = (error as Error).message || "Failed to update product images and videos";
      toastHelper.showTost(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] transform transition-all duration-300 scale-100 flex flex-col">
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Product Images & Videos
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {product?.specification || product?.name || 'Product'} - Manage images and videos
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-transform duration-200 hover:scale-110 p-2"
              disabled={isLoading}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form
            id="product-image-video-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Images Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-images text-blue-600"></i>
                Images
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                  (Max {MAX_IMAGES} images)
                </span>
              </h3>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'image')}
                onClick={() => handleClick('image')}
                className={`w-full p-6 bg-white dark:bg-gray-800 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={(e) => handleFileChange(e, 'image')}
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isLoading}
                />
                {existingImages.length + newImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {existingImages.map((url, index) => (
                      <div
                        key={`existing-${index}`}
                        className="relative group"
                      >
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                          <img
                            src={getImageUrl(url)}
                            alt={`Existing ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                placeholderImage;
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveExistingImage(index);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                          disabled={isLoading}
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      </div>
                    ))}
                    {newImages.map((image, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Uploaded ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveNewImage(index);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                          disabled={isLoading}
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      </div>
                    ))}
                    {existingImages.length + newImages.length < MAX_IMAGES && (
                      <div
                        className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClick('image');
                        }}
                      >
                        <i className="fas fa-plus text-2xl text-gray-400 dark:text-gray-500 mb-2"></i>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Add More</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <i className="fas fa-cloud-upload-alt text-5xl text-gray-400 dark:text-gray-500 mb-4"></i>
                    <p className="text-gray-600 dark:text-gray-400 text-base font-medium mb-2">
                      Drag & drop images here or click to browse
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      Supports JPG, PNG, GIF (max {MAX_IMAGES} images)
                    </p>
                  </div>
                )}
              </div>
              {imageError && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  {imageError}
                </p>
              )}
            </div>

            {/* Videos Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-video text-blue-600"></i>
                Videos
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                  (Max {MAX_VIDEOS} videos)
                </span>
              </h3>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'video')}
                onClick={() => handleClick('video')}
                className={`w-full p-6 bg-white dark:bg-gray-800 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={(e) => handleFileChange(e, 'video')}
                  accept="video/*"
                  multiple
                  className="hidden"
                  disabled={isLoading}
                />
                {existingVideos.length + newVideos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {existingVideos.map((url, index) => {
                      const videoUrl = getVideoUrl(url);
                      return (
                        <div
                          key={`existing-video-${index}`}
                          className="relative group"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative">
                            <video
                              src={videoUrl}
                              className="w-full h-full object-cover"
                              preload="metadata"
                              muted
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.video-fallback')) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'video-fallback absolute inset-0 flex items-center justify-center';
                                  fallback.innerHTML = '<i class="fas fa-video text-3xl text-gray-400"></i>';
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVideo(videoUrl);
                                }}
                                className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:scale-110"
                                disabled={isLoading}
                              >
                                <i className="fas fa-play text-lg ml-1"></i>
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveExistingVideo(index);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-10"
                            disabled={isLoading}
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </div>
                      );
                    })}
                    {newVideos.map((video, index) => {
                      const videoUrl = URL.createObjectURL(video);
                      return (
                        <div key={`new-video-${index}`} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative">
                            <video
                              src={videoUrl}
                              className="w-full h-full object-cover"
                              preload="metadata"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVideo(videoUrl);
                                }}
                                className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:scale-110"
                                disabled={isLoading}
                              >
                                <i className="fas fa-play text-lg ml-1"></i>
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveNewVideo(index);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100 z-10"
                            disabled={isLoading}
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </div>
                      );
                    })}
                    {existingVideos.length + newVideos.length < MAX_VIDEOS && (
                      <div
                        className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClick('video');
                        }}
                      >
                        <i className="fas fa-plus text-2xl text-gray-400 dark:text-gray-500 mb-2"></i>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Add More</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <i className="fas fa-cloud-upload-alt text-5xl text-gray-400 dark:text-gray-500 mb-4"></i>
                    <p className="text-gray-600 dark:text-gray-400 text-base font-medium mb-2">
                      Drag & drop videos here or click to browse
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      Supports MP4, MOV, AVI (max {MAX_VIDEOS} videos)
                    </p>
                  </div>
                )}
              </div>
              {videoError && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  {videoError}
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Video Viewer Modal */}
        {selectedVideo && (
          <div
            className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Video Player
                </h3>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <video
                  src={selectedVideo}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-[70vh] rounded-lg"
                  onError={(e) => {
                    console.error('Video playback error:', e);
                    toastHelper.showTost('Failed to load video', 'error');
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-sm font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-image-video-form"
              className="min-w-[160px] px-6 py-2.5 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i>
                  <span>Update Images & Videos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductImageVideoModal;

