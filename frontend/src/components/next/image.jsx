import React from "react";

const Image = ({ src, alt, width, height, ...props }) => (
  <img src={src} alt={alt} width={width} height={height} {...props} />
);

export default Image;
