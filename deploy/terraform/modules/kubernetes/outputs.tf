output "cluster_endpoint" {
  description = "Kubernetes API server endpoint."
  value       = data.aws_eks_cluster.this.endpoint
}

output "cluster_version" {
  description = "Kubernetes version of the referenced cluster."
  value       = data.aws_eks_cluster.this.version
}

output "node_security_group_id" {
  description = "Cluster security group ID used to scope data-store ingress."
  value       = local.node_security_group_id
}

output "oidc_provider_arn" {
  description = "IRSA OIDC provider issuer (for IAM-roles-for-service-accounts)."
  value       = data.aws_eks_cluster.this.identity[0].oidc[0].issuer
}
