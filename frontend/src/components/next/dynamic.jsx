import React, { Suspense } from "react";

/**
 * @param {() => Promise<{default: React.ComponentType<any>}>} importFunc
 * @param {any} options
 * @returns {React.ComponentType<any>}
 */
const dynamic = (importFunc, options = {}) => {
  const {
    ssr = true,
    loading: LoadingComponent = () => <div>Loading...</div>,
  } = options;

  const LazyComponent = React.lazy(importFunc);

  return (props) => (
    <Suspense fallback={<LoadingComponent />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

export default dynamic;
