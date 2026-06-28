variable "cluster_name" {
  description = "Name of the existing Kubernetes (EKS) cluster to reference."
  type        = string
}

variable "tags" {
  description = "Tags (unused for data lookups; kept for interface symmetry)."
  type        = map(string)
  default     = {}
}
