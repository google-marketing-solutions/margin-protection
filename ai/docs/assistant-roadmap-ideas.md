# Roadmap and Ideas for Standalone Service Utilization

This document outlines potential future directions for the project, focusing on how each package could be adapted or used as a standalone microservice or tool.

## 1. Using the `backend` with other Frontends (React, Vue, etc.)

The backend is already a self-contained microservice. It can be used by any frontend framework, not just the provided Angular application.

**Plan:**

- **`docs(api):` Enhance API Documentation:**

  - Create a more detailed API usage guide based on the existing `3-api-reference.md` and `swagger.yaml`.
  - Provide clear examples using `curl` or Postman for each endpoint (`/login`, `/api/user`, `/api/agent/invoke`).

- **`feat(examples):` Create a React Frontend Example:**
  - Add a new package, `packages/frontend-react`, to the monorepo.
  - This package would be a minimal React application demonstrating how to:
    1.  Redirect to the backend's `/login` endpoint.
    2.  Handle the callback and send the authorization code to the backend.
    3.  Store the user session/token.
    4.  Make authenticated requests to `/api/user`.

## 2. Using the `frontend` with a different Backend

The Angular frontend can be pointed to any backend, as long as that backend implements the same API contract.

**Plan:**

- **`docs(frontend):` Create a Backend Integration Guide:**
  - Document the exact API contract the frontend expects. This includes the routes, request methods, and expected JSON payloads for `/login`, `/auth/google/callback`, and `/api/user`.
  - Explain how to configure the `frontend/src/environments/environment.ts` file to point to a different backend API URL.

## 3. Evolving the `cli` into a General-Purpose Tool

The `cli` tool is currently specific to this project's Terraform configuration. It could be evolved into a more generic infrastructure deployment tool.

**Plan:**

- **`refactor(cli):` Decouple CLI from specific Terraform files:** (Implemented)

  - The CLI now accepts a `--terraform-dir` argument (and `TERRAFORM_DIR` environment variable) to specify the path to a directory of Terraform files, rather than assuming it's in `./terraform`.
  - This allows the CLI to be published as a standalone npm package and used to deploy other, similar infrastructure patterns.

- **`feat(cli):` Make the CLI configuration-driven:**
  - Instead of relying solely on interactive prompts and environment variables, allow the CLI to read a project configuration file (e.g., `project.yaml`).
  - This file would define the resources to create, their names, regions, and other settings, making the tool more flexible and suitable for CI/CD environments.

## 4. Adapting the API Gateway (`docker/proxy`)

The API Gateway is defined by the `swagger.yaml` configuration. This can be easily adapted to create a gateway for a different set of microservices.

**Plan:**

- **`docs(proxy):` Document API Gateway Configuration:**
  - Create a guide explaining how the `swagger.yaml` file works, specifically the `x-google-backend` extension.
  - Show examples of how to add new paths or route to different backend services (e.g., another Cloud Run service or a Cloud Function).
