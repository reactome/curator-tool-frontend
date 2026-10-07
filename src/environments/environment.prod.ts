export const environment = {
    production: true,
    ApiRoot: "/api/curation",
    authURL: "/api/auth",
  curatorGraphBaseUrl: "https://newcurator.reactome.org/curatorgraph",
    llmURL: "/llm",
    // curator-tool-llm REST service; adjust to wherever the reverse proxy exposes it
    llmApiURL: "/llm/api/llm",
    // Natural-language graph query sidecar (neo4jmcp), proxied by Apache next to /api/curation
    nlQueryURL: "/api/nlquery"
  };
