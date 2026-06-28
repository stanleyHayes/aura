# CDN + WAF (§18.2): fronts static web assets / the public edge, with WAF rules
# for common attacks (OWASP managed ruleset) and basic bot/rate mitigation (§14).
#
# CloudFront and a CLOUDFRONT-scoped WAF must live in us-east-1. The root passes
# an aliased provider (aws.us_east_1); the requirement is declared in versions.tf.

# Origin Access Control: CloudFront reads the private S3 origin without the
# bucket ever being public.
resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.name_prefix}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# WAF web ACL: AWS managed common + known-bad-inputs rulesets, plus a
# rate-based rule. Scope CLOUDFRONT → must be created in us-east-1.
resource "aws_wafv2_web_acl" "this" {
  provider    = aws.us_east_1
  name        = "${var.name_prefix}-waf"
  description = "CBS public edge WAF."
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "aws-common"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-known-bad-inputs"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit"
    priority = 3
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

# Security-headers response policy (§14): HSTS, nosniff, frame-ancestors none,
# Referrer-Policy. CSP is nonce-based and set by the app, not duplicated here.
resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${var.name_prefix}-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "CBS public edge (${var.public_domain})."
  aliases         = var.acm_certificate_arn != "" ? [var.public_domain] : []
  web_acl_id      = aws_wafv2_web_acl.this.arn
  price_class     = "PriceClass_100"

  origin {
    domain_name              = "${var.origin_bucket_name}.s3.amazonaws.com"
    origin_id                = "s3-${var.origin_bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${var.origin_bucket_name}"
    viewer_protocol_policy = "redirect-to-https" # HTTP→HTTPS (§18.2).
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    # AWS managed CachingOptimized policy id.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == ""
    acm_certificate_arn            = var.acm_certificate_arn != "" ? var.acm_certificate_arn : null
    ssl_support_method             = var.acm_certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = var.acm_certificate_arn != "" ? "TLSv1.2_2021" : "TLSv1"
  }

  tags = var.tags
}

# Allow CloudFront (via OAC) to read the private origin bucket.
resource "aws_s3_bucket_policy" "origin" {
  bucket = var.origin_bucket_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${var.origin_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.this.arn
          }
        }
      },
    ]
  })
}
