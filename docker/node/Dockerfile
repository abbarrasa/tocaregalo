ARG NODE_BASE_IMAGE

FROM ${NODE_BASE_IMAGE} AS development

WORKDIR /workspace/frontend

# Dependencies must already exist following explicit 002:T2 authorization.
# Starting the development server never runs npm install or npm ci.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
