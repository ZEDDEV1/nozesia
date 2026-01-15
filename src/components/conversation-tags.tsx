"use client";

import { useState, useEffect, useRef } from "react";
import { Tag, Plus, X, Check } from "lucide-react";

interface TagData {
    id: string;
    name: string;
    color: string;
}

interface ConversationTagsProps {
    conversationId: string;
    initialTags?: TagData[];
    onTagsChange?: (tags: TagData[]) => void;
    compact?: boolean;
}

export function ConversationTags({
    conversationId,
    initialTags = [],
    onTagsChange,
    compact = false
}: ConversationTagsProps) {
    const [tags, setTags] = useState<TagData[]>(initialTags);
    const [allTags, setAllTags] = useState<TagData[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Update local state when initialTags change
    useEffect(() => {
        setTags(initialTags);
    }, [initialTags]);

    // Fetch all available tags when dropdown opens
    useEffect(() => {
        if (isOpen && allTags.length === 0) {
            fetchAllTags();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;

            // Check if click was inside the container
            if (dropdownRef.current && dropdownRef.current.contains(target)) {
                return;
            }

            // Check if click was inside any tags dropdown (including fixed positioned)
            const dropdown = document.querySelector('.conversation-tags-dropdown');
            if (dropdown && dropdown.contains(target)) {
                return;
            }

            setIsOpen(false);
        }

        if (isOpen) {
            // Using mousedown to close before click events on other elements
            // But our checks above prevent closing when clicking inside the dropdown
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const fetchAllTags = async () => {
        try {
            const res = await fetch("/api/tags");
            const data = await res.json();
            if (data.success) {
                setAllTags(data.data);
            }
        } catch (error) {
            console.error("Error fetching tags:", error);
        }
    };

    const toggleTag = async (tag: TagData) => {
        const isSelected = tags.some(t => t.id === tag.id);
        const newTags = isSelected
            ? tags.filter(t => t.id !== tag.id)
            : [...tags, tag];

        setLoading(true);
        try {
            const res = await fetch(`/api/conversations/${conversationId}/tags`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tagIds: newTags.map(t => t.id) }),
            });

            const data = await res.json();
            if (data.success) {
                setTags(data.data);
                onTagsChange?.(data.data);
            }
        } catch (error) {
            console.error("Error updating tags:", error);
        } finally {
            setLoading(false);
        }
    };

    const removeTag = async (tagId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newTags = tags.filter(t => t.id !== tagId);

        setLoading(true);
        try {
            const res = await fetch(`/api/conversations/${conversationId}/tags`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tagIds: newTags.map(t => t.id) }),
            });

            const data = await res.json();
            if (data.success) {
                setTags(data.data);
                onTagsChange?.(data.data);
            }
        } catch (error) {
            console.error("Error removing tag:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="conversation-tags-container" ref={dropdownRef}>
            {/* Display current tags */}
            <div className="conversation-tags-list">
                {tags.map(tag => (
                    <span
                        key={tag.id}
                        className="conversation-tag"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
                    >
                        {tag.name}
                        {!compact && (
                            <button
                                onClick={(e) => removeTag(tag.id, e)}
                                className="conversation-tag-remove"
                                disabled={loading}
                            >
                                <X size={10} />
                            </button>
                        )}
                    </span>
                ))}

                {/* Add tag button */}
                <button
                    className="conversation-tag-add"
                    onClick={() => setIsOpen(!isOpen)}
                    title="Adicionar tag"
                >
                    <Plus size={12} />
                </button>
            </div>

            {/* Dropdown for selecting tags */}
            {isOpen && (
                <div className="conversation-tags-dropdown">
                    <div className="conversation-tags-dropdown-header">
                        <Tag size={14} />
                        <span>Selecionar Tags</span>
                    </div>

                    <div className="conversation-tags-dropdown-list">
                        {allTags.length === 0 ? (
                            <div className="conversation-tags-empty">
                                Nenhuma tag criada
                            </div>
                        ) : (
                            allTags.map(tag => {
                                const isSelected = tags.some(t => t.id === tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        className={`conversation-tags-option ${isSelected ? "selected" : ""}`}
                                        onClick={() => toggleTag(tag)}
                                        disabled={loading}
                                    >
                                        <span
                                            className="conversation-tags-option-color"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="conversation-tags-option-name">{tag.name}</span>
                                        {isSelected && <Check size={14} className="conversation-tags-option-check" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Display-only version for list views
export function ConversationTagsBadges({ tags }: { tags: TagData[] }) {
    if (tags.length === 0) return null;

    return (
        <div className="conversation-tags-badges">
            {tags.slice(0, 3).map(tag => (
                <span
                    key={tag.id}
                    className="conversation-tag-badge"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    title={tag.name}
                >
                    {tag.name}
                </span>
            ))}
            {tags.length > 3 && (
                <span className="conversation-tag-badge more">
                    +{tags.length - 3}
                </span>
            )}
        </div>
    );
}
