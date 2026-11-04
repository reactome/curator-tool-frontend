export const environment = {
    production: false,
    ApiRoot: "http://localhost:9090/api/curation",
    authURL: "http://localhost:9090/api/auth",
  curatorGraphBaseUrl: "https://newcurator.reactome.org/curatorgraph",
    // curator-tool-llm REST service (Paper2Path, and Gene2Path's pathway and paper searches with GENE_SEARCH=1):
    // uvicorn curator_llm.main:app --port 8000
    llmApiURL: "http://localhost:8000/api/llm",
    // Natural-language graph query sidecar (webbenchmcp/nlquery, ./run.sh on :8095). It validates
    // tokens against CURATOR_WS_URL in webbenchmcp/.env, which must match authURL's host (:9090).
    nlQueryURL: "http://localhost:8095/api/nlquery",
    llmOn: false
  };
