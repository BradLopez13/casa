
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "household_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"created_by": string | null,"expires_at": string,"household_id": string,"id": string,"revoked_at": string | null,"token_hash": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at": string,"household_id": string,"id"?: string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"household_id"?: string,"id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "household_id": string,"id": string,"joined_at": string,"left_at": string | null,"role": string,"user_id": string
                  }
                  Insert: {
                    "household_id": string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "household_id"?: string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"locale": string,"user_id": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"locale"?: string,"user_id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"locale"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shopping_items": {
                  Row: {
                    "bought_at": string | null,"bought_by": string | null,"cleared_at": string | null,"created_at": string,"created_by": string | null,"household_id": string,"id": string,"name": string,"normalized_name": string | null,"quantity": string | null
                  }
                  Insert: {
                    "bought_at"?: string | null,"bought_by"?: string | null,"cleared_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id": string,"id": string,"name": string,"normalized_name"?: never,"quantity"?: string | null
                  }
                  Update: {
                    "bought_at"?: string | null,"bought_by"?: string | null,"cleared_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"normalized_name"?: never,"quantity"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"task_occurrences": {
                  Row: {
                    "assignee_id": string | null,"completed_at": string | null,"completed_by": string | null,"created_at": string,"due_on": string | null,"generated_from": string | null,"household_id": string,"id": string,"series_id": string,"skipped_at": string | null,"skipped_by": string | null
                  }
                  Insert: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"due_on"?: string | null,"generated_from"?: string | null,"household_id": string,"id"?: string,"series_id": string,"skipped_at"?: string | null,"skipped_by"?: string | null
                  }
                  Update: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"due_on"?: string | null,"generated_from"?: string | null,"household_id"?: string,"id"?: string,"series_id"?: string,"skipped_at"?: string | null,"skipped_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_occurrences_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "task_occurrences_generated_from_fkey"
      columns: ["generated_from"]
isOneToOne: false
      referencedRelation: "task_occurrences"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_occurrences_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_occurrences_series_id_household_id_fkey"
      columns: ["series_id","household_id"]
isOneToOne: false
      referencedRelation: "task_series"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"task_series": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string,"id": string,"recurrence_rule": Json | null,"room": string | null,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"recurrence_rule"?: Json | null,"room"?: string | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"recurrence_rule"?: Json | null,"room"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_series_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"add_shopping_item":
{ Args: { "p_household_id": string,"p_id": string,"p_name": string,"p_quantity": string }; Returns: string
                           },
"clear_bought_items":
{ Args: { "p_household_id": string }; Returns: undefined
                           },
"complete_task":
{ Args: { "p_id": string,"p_today": string }; Returns: undefined
                           },
"create_household":
{ Args: { "p_name": string }; Returns: string
                           },
"create_invite":
{ Args: { "p_household_id": string }; Returns: {
              "expires_at": string,"invite_id": string,"token": string
            }[]
                           },
"create_task":
{ Args: { "p_assignee_id": string,"p_due_on": string,"p_household_id": string,"p_id": string,"p_recurrence": Json,"p_room": string,"p_title": string }; Returns: string
                           },
"delete_household":
{ Args: { "p_household_id": string }; Returns: undefined
                           },
"delete_shopping_item":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_task":
{ Args: { "p_id": string }; Returns: undefined
                           },
"leave_household":
{ Args: { "p_household_id": string }; Returns: undefined
                           },
"remove_member":
{ Args: { "p_household_id": string,"p_user_id": string }; Returns: undefined
                           },
"reopen_task":
{ Args: { "p_id": string }; Returns: undefined
                           },
"revoke_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"set_item_bought":
{ Args: { "p_bought": boolean,"p_id": string }; Returns: undefined
                           },
"shopping_history":
{ Args: { "p_household_id": string }; Returns: {
              "last_used_at": string,"name": string,"normalized_name": string,"uses": number
            }[]
                           },
"skip_task":
{ Args: { "p_id": string,"p_today": string }; Returns: undefined
                           },
"transfer_ownership":
{ Args: { "p_household_id": string,"p_new_owner_id": string }; Returns: undefined
                           },
"update_shopping_item":
{ Args: { "p_id": string,"p_name": string,"p_quantity": string }; Returns: undefined
                           },
"update_task":
{ Args: { "p_assignee_id": string,"p_due_on": string,"p_id": string,"p_recurrence": Json,"p_room": string,"p_title": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
