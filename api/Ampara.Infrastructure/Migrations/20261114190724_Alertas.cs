using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Alertas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Alertas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OcorrenciaId = table.Column<Guid>(type: "uuid", nullable: false),
                    GuardiaoId = table.Column<Guid>(type: "uuid", nullable: false),
                    GuardiaoUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: false),
                    DisparadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CienteEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EscaladoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Alertas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Alertas_Guardioes_GuardiaoId",
                        column: x => x.GuardiaoId,
                        principalTable: "Guardioes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Alertas_Ocorrencias_OcorrenciaId",
                        column: x => x.OcorrenciaId,
                        principalTable: "Ocorrencias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Alertas_Usuarios_GuardiaoUsuarioId",
                        column: x => x.GuardiaoUsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_GuardiaoId",
                table: "Alertas",
                column: "GuardiaoId");

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_GuardiaoUsuarioId_Estado",
                table: "Alertas",
                columns: new[] { "GuardiaoUsuarioId", "Estado" });

            migrationBuilder.CreateIndex(
                name: "IX_Alertas_OcorrenciaId",
                table: "Alertas",
                column: "OcorrenciaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Alertas");
        }
    }
}
