package handlers

import (
	"sort"
	"strings"

	"devtrace-ai-backend/models"
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
		promptPatterns := make([]string, len(devPrompts))
		for i, p := range devPrompts {
			pattern := detectPattern(p.Prompt)
			patternCounts[pattern]++
			promptPatterns[i] = pattern
		}

		var patterns []models.PatternCount
		for pattern, count := range patternCounts {
			patterns = append(patterns, models.PatternCount{Pattern: pattern, Count: count})
		}
		sort.Slice(patterns, func(i, j int) bool {
			return patterns[i].Count > patterns[j].Count
		})

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
				Timestamp: devPrompts[i].Timestamp,
			})
		}

		results = append(results, models.DeveloperPatterns{
			DeveloperID:   devID,
			TotalPrompts:  len(devPrompts),
			LastActive:    devPrompts[0].Timestamp,
			Patterns:      patterns,
			RecentPrompts: recent,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].LastActive.After(results[j].LastActive)
	})

	return results
}
