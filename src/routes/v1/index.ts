import { createFileRoute } from '@tanstack/react-router'

export const serviceIndex = {
  service: 'modelschemas',
  description:
    'Live AI model schemas: per-endpoint request/response JSON Schemas and model metadata for monitored providers, auto-refreshed.',
  documentation: {
    openapi: '/openapi.json',
    agents: '/llms.txt',
  },
  _links: {
    status: '/v1/status',
    providers: '/v1/providers',
    models: '/v1/models{?activity,provider,capability,q}',
    model: '/v1/models/{provider}/{modelId}',
    schemas: '/v1/schemas/{provider}',
    activitySchemas: '/v1/schemas/{provider}/{activity}',
    schema: '/v1/schemas/{provider}/{activity}/{endpointId}{?kind,version}',
    validate: 'POST /v1/validate',
    changes: '/v1/changes{?since,provider,type,cursor,limit}',
    agentDiscovery: '/.well-known/agent-configuration',
  },
}

export const Route = createFileRoute('/v1/')({
  server: {
    handlers: {
      GET: () => Response.json(serviceIndex),
    },
  },
})
