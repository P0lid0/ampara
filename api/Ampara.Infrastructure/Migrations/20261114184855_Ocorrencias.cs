using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Ocorrencias : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Ocorrencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Origem = table.Column<string>(type: "text", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: false),
                    IniciadaEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EncerradaEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MomentoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MomentoLat = table.Column<double>(type: "double precision", nullable: true),
                    MomentoLng = table.Column<double>(type: "double precision", nullable: true),
                    ChaveiroDeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ChaveiroAlertId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ProtocoloPolicia = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ocorrencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Ocorrencias_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PassosOcorrencia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OcorrenciaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Passo = table.Column<string>(type: "text", nullable: false),
                    ConcluidoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PassosOcorrencia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PassosOcorrencia_Ocorrencias_OcorrenciaId",
                        column: x => x.OcorrenciaId,
                        principalTable: "Ocorrencias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Ocorrencias_ChaveiroDeviceId_ChaveiroAlertId",
                table: "Ocorrencias",
                columns: new[] { "ChaveiroDeviceId", "ChaveiroAlertId" });

            migrationBuilder.CreateIndex(
                name: "UX_Ocorrencias_UmaAbertaPorUsuario",
                table: "Ocorrencias",
                column: "UsuarioId",
                unique: true,
                filter: "\"Estado\" = 'Aberta'");

            migrationBuilder.CreateIndex(
                name: "IX_PassosOcorrencia_OcorrenciaId_Passo",
                table: "PassosOcorrencia",
                columns: new[] { "OcorrenciaId", "Passo" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PassosOcorrencia");

            migrationBuilder.DropTable(
                name: "Ocorrencias");
        }
    }
}
