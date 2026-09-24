-- Content Engine - 005_evidence_proof_type.sql
-- Adds proof_type tagging to evidence rows so the pipeline can enforce a
-- required proof mix (named-company examples / expert quotes / statistics).

alter table ce_evidence
  add column if not exists proof_type text;

create index if not exists idx_ce_evidence_proof on ce_evidence(session_id, proof_type);