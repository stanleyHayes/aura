variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
}

variable "vpc_id" {
  description = "VPC for the subnet group and security group."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the cache subnet group."
  type        = list(string)
}

variable "node_type" {
  description = "Cache node type."
  type        = string
  default     = "cache.t4g.medium"
}

variable "engine_version" {
  description = "Valkey/Redis engine version (§18.2 Valkey 8)."
  type        = string
  default     = "8.0"
}

variable "replicas_per_node_group" {
  description = "Read replicas per shard for HA failover."
  type        = number
  default     = 1
}

variable "allowed_security_groups" {
  description = "Security group IDs permitted to reach Redis on 6379."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
