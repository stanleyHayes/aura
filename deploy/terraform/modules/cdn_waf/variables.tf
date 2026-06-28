variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
}

variable "public_domain" {
  description = "Public domain served via the CDN (e.g. cbs.example.edu)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for the CDN; empty uses default cert."
  type        = string
  default     = ""
}

variable "origin_bucket_name" {
  description = "Name of the S3 origin bucket for static assets/exports."
  type        = string
}

variable "origin_bucket_arn" {
  description = "ARN of the S3 origin bucket (for the OAC bucket policy)."
  type        = string
}

variable "rate_limit_per_5min" {
  description = "WAF rate-based rule threshold per IP per 5 minutes (§14)."
  type        = number
  default     = 2000
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
