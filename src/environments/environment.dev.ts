export const environment = {
    production: false,
    ApiRoot: "http://localhost:9090/api/curation",
    authURL: "http://localhost:9090/api/auth",
  curatorGraphBaseUrl: "https://newcurator.reactome.org/curatorgraph",
    llmURL: "http://127.0.0.1:5000",
    // curator-tool-llm REST service (paper annotation and chat): uvicorn curator_llm.main:app --port 8000
    llmApiURL: "http://localhost:8000/api/llm",
    // Natural-language graph query sidecar (neo4jmcp). It validates tokens against the server's
    // curator-tool-ws, so a local login can't use it; this only works on the deployed site.
    nlQueryURL: "/api/nlquery",
    llmOn: false
  };
