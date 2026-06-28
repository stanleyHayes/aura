variable "name_prefix" {
  description = "Prefix for the bucket name."
  type        = string
}

variable "bucket_suffix" {
  description = "Suffix appended to the bucket name (e.g. uploads)."
  type        = string
  default     = "objects"
}

variable "noncurrent_version_expiration_days" {
  description = "Days after which non-current object versions are expired."
  type        = number
  default     = 90
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
