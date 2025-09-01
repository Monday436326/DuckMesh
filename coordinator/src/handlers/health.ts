import { APIGatewayProxyHandler } from 'aws-lambda';

export const check: APIGatewayProxyHandler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'duckmesh-coordinator'
    })
  };
};