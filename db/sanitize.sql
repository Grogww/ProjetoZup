-- ============================================================================
-- sanitize.sql
-- ----------------------------------------------------------------------------
-- Remove dados pessoais reais antes de gerar o backup público (zup_backup.backup).
-- Deve ser executado contra um banco JÁ RESTAURADO a partir do dump oficial
-- (o de desenvolvimento, com dados reais) e ANTES do pg_dump que vai ao repo.
--
-- O que faz:
--   - Anonimiza nome, e-mail e CPF de TODOS os usuários
--   - Gera CPFs FICTÍCIOS porém VÁLIDOS (dígitos verificadores corretos),
--     porque o login valida o CPF antes de consultar o banco (ver utils/cpf.js)
--   - Troca a senha de todos para uma senha de demonstração conhecida
--   - Remove avatares e tokens (reset/refresh) que possam identificar alguém
--
-- Login: por CPF + senha. Senha de demonstração de todos: Demo@1234
-- (hash bcrypt, 10 rounds — compatível com BCRYPT_SALT_ROUNDS=10)
-- ============================================================================

BEGIN;

-- Função auxiliar (criada e removida dentro desta mesma transação): dado um
-- número, devolve um CPF de 11 dígitos válido, calculando os dois dígitos
-- verificadores. Fica no schema corrente (public) para evitar a dependência
-- do schema de sessão pg_temp, que só passa a existir após o primeiro objeto
-- temporário e não sobrevive entre conexões distintas do psql.
CREATE OR REPLACE FUNCTION make_valid_cpf(seed bigint) RETURNS text AS $$
DECLARE
  base text;
  cpf_full text;   -- 'full' é palavra reservada (FULL JOIN); não usar como identificador
  s int;
  w int;
  i int;
  r int;
BEGIN
  -- 9 dígitos base, derivados do seed de forma determinística e distinta por id.
  base := lpad(((seed * 1234567) % 1000000000)::text, 9, '0');

  -- 1º dígito verificador (pesos 10..2)
  s := 0; w := 10;
  FOR i IN 1..9 LOOP
    s := s + substr(base, i, 1)::int * w;
    w := w - 1;
  END LOOP;
  r := (s * 10) % 11;
  IF r = 10 THEN r := 0; END IF;
  base := base || r::text;

  -- 2º dígito verificador (pesos 11..2)
  s := 0; w := 11;
  FOR i IN 1..10 LOOP
    s := s + substr(base, i, 1)::int * w;
    w := w - 1;
  END LOOP;
  r := (s * 10) % 11;
  IF r = 10 THEN r := 0; END IF;
  cpf_full := base || r::text;

  RETURN cpf_full;
END;
$$ LANGUAGE plpgsql;

-- Guarda: se não houver usuários, algo deu errado no restore. Falha alto
-- em vez de gerar um backup "sanitizado" vazio por engano.
DO $$
BEGIN
  IF (SELECT count(*) FROM users) = 0 THEN
    RAISE EXCEPTION 'Tabela users vazia — restore provavelmente não rodou. Abortando sanitização.';
  END IF;
END $$;

UPDATE users SET
  name                   = 'Usuário ' || id,
  email                  = 'user' || id || '@exemplo.com',
  cpf                    = make_valid_cpf(id),
  -- hash bcrypt de 'Demo@1234' (10 rounds) — verificado contra src/utils + bcrypt
  password_hash          = '$2b$10$GYHEYUnRVRzBCZ34EeT3geqONRhuvT7FqcFEZo0W5vZPTrlPOjVnC',
  is_active              = TRUE,   -- garante que todo usuário de demo consegue logar
  avatar_url             = NULL,
  reset_token            = NULL,
  reset_token_expires_at = NULL,
  refresh_token          = NULL;

DROP FUNCTION make_valid_cpf(bigint);

COMMIT;

-- Conferência: mostra o CPF (login) e o papel de cada usuário.
-- Use um desses CPFs + a senha Demo@1234 para entrar.
SELECT id, name, email, cpf, role FROM users ORDER BY id;
