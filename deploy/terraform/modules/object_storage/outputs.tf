output "bucket_name" {
  description = "Name of the object-storage bucket (S3_BUCKET)."
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "ARN of the object-storage bucket."
  value       = aws_s3_bucket.this.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name (for CDN origin wiring)."
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}
