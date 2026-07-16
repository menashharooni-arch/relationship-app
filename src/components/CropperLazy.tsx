"use client";

// Isolates react-easy-crop (+ its CSS) into its own module so next/dynamic
// can defer loading both until a crop is actually needed — most visitors to
// pages using ImageUpload never open the cropper (performance audit).
import "react-easy-crop/react-easy-crop.css";
export { default } from "react-easy-crop";
