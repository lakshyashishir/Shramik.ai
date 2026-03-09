# Azure layout

Target deployment shape for the first milestone:

- web app hosted separately from backend services
- API, agents, and vision/media services containerized
- Blob Storage for media evidence
- Key Vault for secrets
- Container Apps environment for service deployment
- Azure OpenAI and Speech consumed as external dependencies

Keep all new Azure resources parameterized by environment name.
