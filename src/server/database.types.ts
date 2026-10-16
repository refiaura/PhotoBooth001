export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      booths: {
        Row: {
          caption: string | null;
          code: string;
          created_at: string;
          current_shot: number | null;
          expires_at: string;
          id: string;
          paused_at: string | null;
          paused_from: Database["public"]["Enums"]["booth_status"] | null;
          retake_shot: number | null;
          show_mark: boolean;
          status: Database["public"]["Enums"]["booth_status"];
          strip_date: string | null;
          theme_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          caption?: string | null;
          code: string;
          created_at?: string;
          current_shot?: number | null;
          expires_at?: string;
          id?: string;
          paused_at?: string | null;
          paused_from?: Database["public"]["Enums"]["booth_status"] | null;
          retake_shot?: number | null;
          show_mark?: boolean;
          status?: Database["public"]["Enums"]["booth_status"];
          strip_date?: string | null;
          theme_id: string;
          version?: number;
        };
        Update: {
          caption?: string | null;
          code?: string;
          created_at?: string;
          current_shot?: number | null;
          expires_at?: string;
          id?: string;
          paused_at?: string | null;
          paused_from?: Database["public"]["Enums"]["booth_status"] | null;
          retake_shot?: number | null;
          show_mark?: boolean;
          status?: Database["public"]["Enums"]["booth_status"];
          strip_date?: string | null;
          theme_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "booths_theme_id_fkey";
            columns: ["theme_id"];
            isOneToOne: false;
            referencedRelation: "themes";
            referencedColumns: ["id"];
          },
        ];
      };
      participants: {
        Row: {
          booth_id: string;
          id: string;
          joined_at: string;
          last_seen_at: string;
          role: Database["public"]["Enums"]["participant_role"];
          token_hash: string;
          user_agent: string | null;
        };
        ComputedFields: never;
        Insert: {
          booth_id: string;
          id?: string;
          joined_at?: string;
          last_seen_at?: string;
          role: Database["public"]["Enums"]["participant_role"];
          token_hash: string;
          user_agent?: string | null;
        };
        Update: {
          booth_id?: string;
          id?: string;
          joined_at?: string;
          last_seen_at?: string;
          role?: Database["public"]["Enums"]["participant_role"];
          token_hash?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "participants_booth_id_fkey";
            columns: ["booth_id"];
            isOneToOne: false;
            referencedRelation: "booths";
            referencedColumns: ["id"];
          },
        ];
      };
      photos: {
        Row: {
          booth_id: string;
          captured_at: string;
          created_at: string;
          height: number | null;
          id: string;
          mime_type: string | null;
          participant_id: string;
          shot_index: number;
          size_bytes: number | null;
          storage_key: string;
          uploaded_at: string | null;
          version: number;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          booth_id: string;
          captured_at?: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          participant_id: string;
          shot_index: number;
          size_bytes?: number | null;
          storage_key: string;
          uploaded_at?: string | null;
          version?: number;
          width?: number | null;
        };
        Update: {
          booth_id?: string;
          captured_at?: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          participant_id?: string;
          shot_index?: number;
          size_bytes?: number | null;
          storage_key?: string;
          uploaded_at?: string | null;
          version?: number;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "photos_booth_id_fkey";
            columns: ["booth_id"];
            isOneToOne: false;
            referencedRelation: "booths";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_participant_fk";
            columns: ["participant_id", "booth_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id", "booth_id"];
          },
        ];
      };
      rate_limit_hits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      strips: {
        Row: {
          booth_id: string;
          created_at: string;
          expires_at: string;
          format: Database["public"]["Enums"]["strip_format"];
          id: string;
          public_slug: string;
          storage_key: string;
        };
        ComputedFields: never;
        Insert: {
          booth_id: string;
          created_at?: string;
          expires_at?: string;
          format: Database["public"]["Enums"]["strip_format"];
          id?: string;
          public_slug: string;
          storage_key: string;
        };
        Update: {
          booth_id?: string;
          created_at?: string;
          expires_at?: string;
          format?: Database["public"]["Enums"]["strip_format"];
          id?: string;
          public_slug?: string;
          storage_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "strips_booth_id_fkey";
            columns: ["booth_id"];
            isOneToOne: false;
            referencedRelation: "booths";
            referencedColumns: ["id"];
          },
        ];
      };
      themes: {
        Row: {
          asset_keys: string[];
          created_at: string;
          id: string;
          is_active: boolean;
          layout_json: NonNullable<Json>;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          asset_keys?: string[];
          created_at?: string;
          id: string;
          is_active?: boolean;
          layout_json?: NonNullable<Json>;
          name: string;
        };
        Update: {
          asset_keys?: string[];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          layout_json?: NonNullable<Json>;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      booth_status:
        | "WAITING_GUEST"
        | "WAITING_READY"
        | "CAPTURING"
        | "COMPOSING"
        | "REVIEW"
        | "DONE"
        | "PAUSED"
        | "EXPIRED";
      participant_role: "host" | "guest";
      strip_format: "strip" | "story";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booth_status: [
        "WAITING_GUEST",
        "WAITING_READY",
        "CAPTURING",
        "COMPOSING",
        "REVIEW",
        "DONE",
        "PAUSED",
        "EXPIRED",
      ],
      participant_role: ["host", "guest"],
      strip_format: ["strip", "story"],
    },
  },
} as const;
