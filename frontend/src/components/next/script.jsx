import React from "react";

const Script = ({ src, strategy, children, ...props }) => {
  return (
    <script src={src} {...props}>
      {children}
    </script>
  );
};

export default Script;
