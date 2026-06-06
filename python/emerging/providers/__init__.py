"""Real-inference providers for emerging-tech features.

Each module imports its heavy/optional dependency lazily inside functions so the
package is always importable. They are only invoked when capability detection
confirms the dependency (and any key/server) is available.
"""
