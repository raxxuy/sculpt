# Sculpt

Sculpt is a library for transforming structured data based on relationships, rules, and derived values.

It provides a generic way to describe how parts of data relate to each other and how changes should propagate through those relationships.

Sculpt is domain-agnostic. It does not define what data represents or how it should behave. Instead, domains can build on top of Sculpt by providing their own transformations, rules, and plugins.

## Goals

* Transform structured data through composable operations
* Model relationships between data
* Derive values from existing data
* Keep transformations reusable and domain-agnostic
* Support extensibility through plugins

## Status

Early development. API and architecture are subject to change.
