# Workflows GitHub Actions

Ce dossier contient les workflows CI/CD pour le projet.

## Workflows disponibles

### 🔍 `ci.yml` - Continuous Integration

**Déclenchement:** Push sur `main` ou Pull Request

**Étapes:**

1. ✅ Type checking (`pnpm typecheck`)
2. ✅ Linting (`pnpm lint`)
3. ✅ Format checking (`pnpm format:check`)
4. ✅ Tests (`pnpm test`)
5. ✅ Build (`pnpm build`)
6. ✅ **API Check** (`pnpm build:api:prod`) - Vérifie que l'API est à jour
7. 📊 Upload coverage (Codecov)

### 📋 `api-review.yml` - API Review for PRs

**Déclenchement:** Pull Request modifiant `src/**/*.ts`, `package.json`, `tsconfig.json` ou
`api-extractor.json`

**Étapes:**

1. 🔨 Build la branche PR
2. 📄 Génère le rapport API de la PR
3. 🔄 Checkout de la branche base (main)
4. 🔨 Build la branche base
5. 📄 Génère le rapport API de la base
6. 🔍 Compare les deux rapports
7. 💬 Commente la PR avec les différences détectées
8. 📦 Upload un artifact avec le diff complet

**Permissions requises:**

- `contents: read` - Pour lire le code
- `pull-requests: write` - Pour commenter les PRs

## Badges de statut

Ajoutez ces badges à votre README.md :

```markdown
[![CI](https://github.com/lokicoule-stack/bus/actions/workflows/ci.yml/badge.svg)](https://github.com/lokicoule-stack/bus/actions/workflows/ci.yml)
[![API Review](https://github.com/lokicoule-stack/bus/actions/workflows/api-review.yml/badge.svg)](https://github.com/lokicoule-stack/bus/actions/workflows/api-review.yml)
```

## Variables d'environnement

Aucune variable d'environnement n'est requise pour ces workflows.

## Secrets

Les workflows utilisent le token GitHub automatique (`GITHUB_TOKEN`) fourni par GitHub Actions.

## Maintenance

### Mettre à jour les versions des actions

Vérifiez régulièrement les nouvelles versions :

- `actions/checkout@v4` → [Releases](https://github.com/actions/checkout/releases)
- `actions/setup-node@v4` → [Releases](https://github.com/actions/setup-node/releases)
- `pnpm/action-setup@v4` → [Releases](https://github.com/pnpm/action-setup/releases)
- `actions/upload-artifact@v4` → [Releases](https://github.com/actions/upload-artifact/releases)
- `actions/github-script@v7` → [Releases](https://github.com/actions/github-script/releases)
- `codecov/codecov-action@v4` → [Releases](https://github.com/codecov/codecov-action/releases)

### Dépannage

#### Le workflow API Review ne se déclenche pas

Vérifiez que votre PR modifie au moins un des fichiers dans `paths:` :

- `src/**/*.ts`
- `package.json`
- `tsconfig.json`
- `api-extractor.json`

#### Le check API échoue en CI

1. Vérifiez que tous les exports publics ont des tags (`@public`, `@beta`, etc.)
2. Assurez-vous que le rapport API est à jour :
   ```bash
   pnpm build && pnpm build:api
   git add etc/bus.api.md
   git commit -m "docs: update API report"
   ```

#### Le commentaire ne s'ajoute pas à la PR

Vérifiez les permissions du workflow :

- `pull-requests: write` doit être activé
- Le token GitHub doit avoir les permissions appropriées

## En savoir plus

- [Documentation complète du processus de review d'API](../docs/API_REVIEW_PROCESS.md)
- [Documentation API Extractor](../docs/API_EXTRACTOR.md)
