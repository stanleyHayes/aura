# References an existing Kubernetes cluster rather than provisioning one — the
# cluster lifecycle is owned by the platform team / a separate root (§18.2 notes
# K8s "or a managed container platform"; the choice is recorded in ADR-0006).
# This module exposes the cluster's endpoint and node security group so the data
# stores can scope their ingress to the application nodes only.

data "aws_eks_cluster" "this" {
  name = var.cluster_name
}

# The cluster's primary (managed) security group. Used as the source for
# Postgres/Redis ingress rules so only in-cluster workloads can connect.
locals {
  node_security_group_id = data.aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}
