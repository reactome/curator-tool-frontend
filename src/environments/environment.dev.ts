export const environment = {
    production: false,
    ApiRoot: "http://localhost:9090/api/curation",
    authURL: "http://localhost:9090/api/auth",
  curatorGraphBaseUrl: "https://newcurator.reactome.org/curatorgraph",
    llmURL: "http://127.0.0.1:5000",
    // curator-tool-llm REST service (paper annotation and chat): uvicorn curator_llm.main:app --port 8000
    llmApiURL: "http://localhost:8000/api/llm",
    llmOn: false
  };
