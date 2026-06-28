{{/*
Common template helpers for the CBS chart.
*/}}

{{- define "cbs.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "cbs.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "cbs.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Labels shared by every object. */}}
{{- define "cbs.labels" -}}
helm.sh/chart: {{ include "cbs.chart" . }}
{{ include "cbs.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: cbs
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "cbs.selectorLabels" -}}
app.kubernetes.io/name: {{ include "cbs.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Per-component selector labels (api | worker). */}}
{{- define "cbs.componentSelectorLabels" -}}
{{ include "cbs.selectorLabels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "cbs.componentLabels" -}}
{{ include "cbs.labels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Full image reference, preferring a pinned digest. */}}
{{- define "cbs.image" -}}
{{- $reg := .Values.image.registry -}}
{{- $repo := .Values.image.repository -}}
{{- if .Values.image.digest -}}
{{- printf "%s/%s@%s" $reg $repo .Values.image.digest -}}
{{- else -}}
{{- printf "%s/%s:%s" $reg $repo .Values.image.tag -}}
{{- end -}}
{{- end -}}

{{- define "cbs.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "cbs.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* Name of the Secret holding sensitive env (§14). */}}
{{- define "cbs.secretName" -}}
{{- if .Values.existingSecret -}}
{{- .Values.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" (include "cbs.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "cbs.configMapName" -}}
{{- printf "%s-config" (include "cbs.fullname" .) -}}
{{- end -}}

{{/*
envFrom block shared by api and worker: non-secret ConfigMap + secret Secret.
*/}}
{{- define "cbs.envFrom" -}}
- configMapRef:
    name: {{ include "cbs.configMapName" . }}
- secretRef:
    name: {{ include "cbs.secretName" . }}
{{- end -}}
