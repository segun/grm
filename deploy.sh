export FLY_API_TOKEN="fm2_lJPECAAAAAAAAKLPxBAkxEqr15qK9TJbDyaO7r5/wrVodHRwczovL2FwaS5mbHkuaW8vdjGUAJLOAAP4RR8Lk7lodHRwczovL2FwaS5mbHkuaW8vYWFhL3YxxDxzEvP+TG7YN6XoiqyWdyS7ERb/aFQgZKmRe0aGdUtDtyeDA3c4Xb3SUjDO/d9NT2A1IOQY+OXeoKKo39HETp6aRQ+xOht7dLBHHaGUzMljtfkNGZi3N9zhV9gdXxR6PF4ArvEv4R7iGtSoKY2OBCbcnbRtNjlGnpzI2OQNtQNkxRp1JOWWfCCLdIGMhsQgihGowoiC6qwv/nBBemCEULqbQMQVfiCh2gFPrT2HyHM=,fm2_lJPETp6aRQ+xOht7dLBHHaGUzMljtfkNGZi3N9zhV9gdXxR6PF4ArvEv4R7iGtSoKY2OBCbcnbRtNjlGnpzI2OQNtQNkxRp1JOWWfCCLdIGMhsQQhMFGAwvNRQbJgP46TMEgo8O5aHR0cHM6Ly9hcGkuZmx5LmlvL2FhYS92MZgEks5n4stbzwAAAAEj2ul5F84AA5w2CpHOAAOcNgzEEMNbdkzwny0vD/W77sPBY1/EINvtT6YOD28ke6r+jEfhqNPzPAvVUaikMx7YnrsYeEDJ"

# Ensure flyctl is installed
if ! command -v flyctl &> /dev/null; then
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

# Deploy the app with the specified app name
flyctl launch --name grm --no-deploy --now --region ord --yes
flyctl deploy -a grm --remote-only
