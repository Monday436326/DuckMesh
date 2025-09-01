terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# S3 Bucket for storing job specs and results
resource "aws_s3_bucket" "duckmesh_storage" {
  bucket = "duckmesh-${var.environment}-storage"
}

resource "aws_s3_bucket_versioning" "duckmesh_storage_versioning" {
  bucket = aws_s3_bucket.duckmesh_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "duckmesh_storage_encryption" {
  bucket = aws_s3_bucket.duckmesh_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# DynamoDB table for job metadata
resource "aws_dynamodb_table" "duckmesh_jobs" {
  name           = "duckmesh-${var.environment}-jobs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  tags = {
    Name        = "DuckMesh Jobs Table"
    Environment = var.environment
  }
}

# SQS Queue for job processing
resource "aws_sqs_queue" "duckmesh_jobs" {
  name                       = "duckmesh-${var.environment}-jobs"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600 # 14 days

  tags = {
    Environment = var.environment
  }
}

# IAM role for Lambda functions
resource "aws_iam_role" "lambda_execution_role" {
  name = "duckmesh-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "duckmesh-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.duckmesh_storage.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.duckmesh_jobs.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.duckmesh_jobs.arn
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "*"
      }
    ]
  })
}

# API Gateway
resource "aws_api_gateway_rest_api" "duckmesh_api" {
  name        = "duckmesh-${var.environment}-api"
  description = "DuckMesh Coordinator API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_deployment" "duckmesh_api_deployment" {
  depends_on = [
    aws_api_gateway_method.assign_job,
    aws_api_gateway_method.collect_results,
    aws_api_gateway_method.health_check
  ]

  rest_api_id = aws_api_gateway_rest_api.duckmesh_api.id
  stage_name  = var.environment
}

# API Gateway resources and methods would be defined here
# ... (additional API Gateway configuration)

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "duckmesh_logs" {
  name              = "/aws/lambda/duckmesh-${var.environment}"
  retention_in_days = 14
}

# Outputs
output "api_gateway_url" {
  value = aws_api_gateway_deployment.duckmesh_api_deployment.invoke_url
}

output "s3_bucket_name" {
  value = aws_s3_bucket.duckmesh_storage.bucket
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.duckmesh_jobs.name
}

output "sqs_queue_url" {
  value = aws_sqs_queue.duckmesh_jobs.url
}
