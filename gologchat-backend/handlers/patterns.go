package handlers

import (
	"sort"
	"strings"

	"gologchat-backend/models"
)

var patternKeywords = map[string][]string{
	"debugging":     {"debug", "error", "fix", "bug", "issue", "crash", "stack trace", "breakpoint", "exception", "panic"},
	"refactoring":   {"refactor", "restructure", "rename", "extract", "clean up", "simplify", "reorganize"},
	"testing":       {"test", "unit test", "integration test", "mock", "assert", "coverage", "spec"},
	"feature":       {"feature", "implement", "add", "create", "build", "new functionality"},
	"documentation": {"document", "readme", "comment", "jsdoc", "godoc", "explain", "describe"},
	"review":        {"review", "code review", "pr review", "pull request", "feedback"},
	"deployment":    {"deploy", "release", "ci/cd", "pipeline", "publish", "ship"},
	"configuration": {"config", "setup", "environment", "settings", "yaml", "toml", "json config"},
	"learning":      {"how to", "what is", "tutorial", "example", "understand", "learn"},
	"api":           {"api", "endpoint", "request", "response", "rest", "graphql", "http"},
}

func detectPattern(promptText string) string {
	lower := strings.ToLower(promptText)
	bestPattern := "other"
	bestScore := 0

	for pattern, keywords := range patternKeywords {
		score := 0
		for _, keyword := range keywords {
			if strings.Contains(lower, keyword) {
				score++
			}
		}
		if score > bestScore {
			bestScore = score
			bestPattern = pattern
		}
	}
	return bestPattern
}

type effectivenessData struct {
	provider string
	total    int
	accepted int
	rejected int
	edited   int
}

func normalizeProvider(p string) string {
	if p == "" {
		return "Other"
	}
	return p
}

func normalizeModel(m string) string {
	if m == "" {
		return "Unknown"
	}
	return m
}

func aggregatePatterns(prompts []models.Prompt) []models.DeveloperPatterns {
	developerPrompts := make(map[string][]models.Prompt)
	for _, p := range prompts {
		developerPrompts[p.DeveloperID] = append(developerPrompts[p.DeveloperID], p)
	}

	var results []models.DeveloperPatterns
	for devID, devPrompts := range developerPrompts {
		sort.Slice(devPrompts, func(i, j int) bool {
			return devPrompts[i].Timestamp.After(devPrompts[j].Timestamp)
		})

		patternCounts := make(map[string]int)
		providerCounts := make(map[string]int)
		promptPatterns := make([]string, len(devPrompts))
		for i, p := range devPrompts {
			pattern := detectPattern(p.Prompt)
			patternCounts[pattern]++
			promptPatterns[i] = pattern
			providerCounts[normalizeProvider(p.Provider)]++
		}

		var patterns []models.PatternCount
		for pattern, count := range patternCounts {
			patterns = append(patterns, models.PatternCount{Pattern: pattern, Count: count})
		}
		sort.Slice(patterns, func(i, j int) bool {
			return patterns[i].Count > patterns[j].Count
		})

		topProvider := ""
		topProvCount := 0
		for prov, count := range providerCounts {
			if count > topProvCount {
				topProvCount = count
				topProvider = prov
			}
		}

		limit := 5
		if len(devPrompts) < limit {
			limit = len(devPrompts)
		}
		var recent []models.RecentPromptSummary
		for i := 0; i < limit; i++ {
			summary := devPrompts[i].Prompt
			if len(summary) > 100 {
				summary = summary[:100] + "..."
			}
			recent = append(recent, models.RecentPromptSummary{
				ID:        devPrompts[i].ID,
				Summary:   summary,
				Pattern:   promptPatterns[i],
				Provider:  devPrompts[i].Provider,
				Model:     devPrompts[i].Model,
				Timestamp: devPrompts[i].Timestamp,
			})
		}

		results = append(results, models.DeveloperPatterns{
			DeveloperID:   devID,
			TotalPrompts:  len(devPrompts),
			LastActive:    devPrompts[0].Timestamp,
			TopProvider:   topProvider,
			Patterns:      patterns,
			RecentPrompts: recent,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].LastActive.After(results[j].LastActive)
	})

	return results
}

func aggregateAnalytics(prompts []models.Prompt) models.OrgAnalytics {
	providerCounts := make(map[string]int)
	modelKeys := make(map[string]int)
	modelProviders := make(map[string]string)
	languageCounts := make(map[string]int)
	patternCounts := make(map[string]int)
	projectCounts := make(map[string]int)
	totalTokens := 0

	effectivenessMap := make(map[string]*effectivenessData)

	for _, p := range prompts {
		provider := normalizeProvider(p.Provider)
		model := normalizeModel(p.Model)

		providerCounts[provider]++

		mk := provider + "|" + model
		modelKeys[mk]++
		modelProviders[mk] = provider

		if p.Language != "" {
			languageCounts[p.Language]++
		}
		if p.Project != "" {
			projectCounts[p.Project]++
		}

		patternCounts[detectPattern(p.Prompt)]++
		totalTokens += p.EstimatedTokens

		ed, ok := effectivenessMap[mk]
		if !ok {
			ed = &effectivenessData{provider: provider}
			effectivenessMap[mk] = ed
		}
		ed.total++
		switch p.Outcome {
		case "accepted":
			ed.accepted++
		case "rejected":
			ed.rejected++
		case "edited":
			ed.edited++
		}
	}

	providers := sortedProviderCounts(providerCounts)
	mdls := sortedModelCounts(modelKeys, modelProviders)
	languages := sortedLanguageCounts(languageCounts)
	patterns := sortedPatternCounts(patternCounts)
	projects := sortedProjectCounts(projectCounts)
	developers := aggregatePatterns(prompts)
	effectiveness := sortedEffectiveness(effectivenessMap)

	return models.OrgAnalytics{
		TotalPrompts:         len(prompts),
		TotalEstimatedTokens: totalTokens,
		Providers:            providers,
		Models:               mdls,
		Languages:            languages,
		Patterns:             patterns,
		Developers:           developers,
		Projects:             projects,
		Effectiveness:        effectiveness,
	}
}

func sortedProviderCounts(m map[string]int) []models.ProviderCount {
	var result []models.ProviderCount
	for provider, count := range m {
		result = append(result, models.ProviderCount{Provider: provider, Count: count})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	return result
}

func sortedModelCounts(counts map[string]int, providers map[string]string) []models.ModelCount {
	var result []models.ModelCount
	for key, count := range counts {
		parts := strings.SplitN(key, "|", 2)
		model := parts[1]
		result = append(result, models.ModelCount{Model: model, Provider: providers[key], Count: count})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	return result
}

func sortedLanguageCounts(m map[string]int) []models.LanguageCount {
	var result []models.LanguageCount
	for lang, count := range m {
		result = append(result, models.LanguageCount{Language: lang, Count: count})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	return result
}

func sortedPatternCounts(m map[string]int) []models.PatternCount {
	var result []models.PatternCount
	for pattern, count := range m {
		result = append(result, models.PatternCount{Pattern: pattern, Count: count})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	return result
}

func sortedProjectCounts(m map[string]int) []models.ProjectCount {
	var result []models.ProjectCount
	for project, count := range m {
		result = append(result, models.ProjectCount{Project: project, Count: count})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	return result
}

func sortedEffectiveness(m map[string]*effectivenessData) []models.ModelEffectiveness {
	var result []models.ModelEffectiveness
	for key, ed := range m {
		parts := strings.SplitN(key, "|", 2)
		model := parts[1]
		pending := ed.total - ed.accepted - ed.rejected - ed.edited
		var rate float64
		if ed.total > 0 {
			rate = float64(ed.accepted) / float64(ed.total)
		}
		result = append(result, models.ModelEffectiveness{
			Model:          model,
			Provider:       ed.provider,
			Total:          ed.total,
			Accepted:       ed.accepted,
			Rejected:       ed.rejected,
			Edited:         ed.edited,
			Pending:        pending,
			AcceptanceRate: rate,
		})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Total > result[j].Total })
	return result
}
